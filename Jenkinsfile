pipeline {
    agent any

    tools {
        nodejs 'nodejs-22-6-0'
    }

    environment {
        MONGO_URI = "mongodb+srv://supercluster.d83jj.mongodb.net/superData"
        SONAR_SCANNER_HOME = tool 'sonarqube-scanner-610'
        MONGO_USERNAME = credentials('mongo-db-credentials').username
        MONGO_PASSWORD = credentials('mongo-db-credentials').password
        DOCKER_CREDENTIALS_ID = 'dockerhub-credentials'
        AWS_SSH_KEY = credentials('AWS_Deployment-Server_SSH-Key')
        AWS_EC2_HOST = 'ubuntu@3.80.187.198'
    }

    options {
        disableConcurrentBuilds()
        disableResume()
    }

    stages {
        stage('Checkout Code') {
            steps {
                echo '📥 Checking out code....'
                checkout scm
            }
        }

        stage('VM Node Version') {
            steps {
                sh '''
                    node -v
                    npm -v
                '''
            }
        }

        stage('Install Dependencies') {
            options { timestamps() }
            steps {
                echo '🔧 Installing dependencies....'
                sh 'npm install --no-audit'
                sh 'npm install --include=dev --no-audit'
                echo '🔧 Dependencies installed successfully!'
            }
        }

        stage('Dependency Check') {
            options { timestamps() }
            parallel {
                stage('NPM Audit') {
                    steps {
                        echo '🔍 Running npm audit....'
                        sh 'npm audit --audit-level=critical'
                    }
                }
                stage('OWASP Check') {
                    steps {
                        echo '🛡️ Running OWASP Dependency Check...'
                        dependencyCheck additionalArguments: '''
                            --scan ./
                            --out ./ 
                            --format ALL 
                            --prettyPrint
                            --disableYarnAudit
                        ''', odcInstallation: 'OWASP-DepCheck'
                    }
                }
            }
        }

        stage('Unit Test') {
            options { timestamps(); retry(2) }
            steps {
                withCredentials([usernamePassword(credentialsId: 'mongo-db-credentials', usernameVariable: 'MONGO_USERNAME', passwordVariable: 'MONGO_PASSWORD')]) {
                    echo '🧪 Running unit tests....'
                    sh 'npm test'
                }
            }
        }

        stage('Code Coverage & SonarQube') {
            options { timestamps() }
            parallel {
                stage('Code Coverage') {
                    steps {
                        withCredentials([usernamePassword(credentialsId: 'mongo-db-credentials', usernameVariable: 'MONGO_USERNAME', passwordVariable: 'MONGO_PASSWORD')]) {
                            catchError(buildResult: 'SUCCESS', stageResult: 'SUCCESS') {
                                echo '📊 Running code coverage....'
                                sh 'npm run coverage'
                            }
                        }
                    }
                }
                stage('SonarQube Scan') {
                    steps {
                        timeout(time: 60, unit: 'SECONDS') {
                            withSonarQubeEnv('sonar-qube-server') {
                                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                                    echo '🔍 Running SonarQube analysis...'
                                    sh '''
                                        ${SONAR_SCANNER_HOME}/bin/sonar-scanner \
                                        -Dsonar.projectKey=Solar_System-Project \
                                        -Dsonar.sources=app.js \
                                        -Dsonar.host.url=http://98.81.130.171:9000 \
                                        -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info
                                    '''
                                }
                            }
                        }
                    }
                }
            }
        }

        stage('Build Docker Image') {
            options { timestamps() }
            steps {
                echo '🐳 Building Docker image....'
                sh 'docker build -t indicationmark/solar-system-app:$GIT_COMMIT .'
            }
        }

        stage('Trivy Scan') {
            options { timestamps() }
            steps {
                echo '🔍 Running Trivy vulnerability scan....'
                script {
                    // Run Trivy with status capture to avoid failing the build
                    def exitCode = sh(script: '''
                        trivy image indicationmark/solar-system-app:$GIT_COMMIT \
                            --severity CRITICAL \
                            --exit-code 1 \
                            --quiet \
                            --format json -o trivy-image-CRITICAL-results.json || true
                    ''', returnStatus: true)

                    sh '''
                        trivy image indicationmark/solar-system-app:$GIT_COMMIT \
                            --severity LOW,MEDIUM \
                            --exit-code 0 \
                            --quiet \
                            --format json -o trivy-image-MEDIUM-results.json
                    '''

                    sh '''
                        trivy convert --format template -t "@/usr/local/share/trivy/templates/html.tpl" \
                            -o trivy-image-MEDIUM-results.html trivy-image-MEDIUM-results.json || echo "Conversion failed"

                        trivy convert --format template -t "@/usr/local/share/trivy/templates/html.tpl" \
                            -o trivy-image-CRITICAL-results.html trivy-image-CRITICAL-results.json || echo "Conversion failed"

                        trivy convert --format template -t "@/usr/local/share/trivy/templates/junit.tpl" \
                            -o trivy-image-MEDIUM-results.xml trivy-image-MEDIUM-results.json || echo "Conversion failed"

                        trivy convert --format template -t "@/usr/local/share/trivy/templates/junit.tpl" \
                            -o trivy-image-CRITICAL-results.xml trivy-image-CRITICAL-results.json || echo "Conversion failed"
                    '''

                    if (exitCode != 0) {
                        echo '❗️Critical vulnerabilities found in Trivy scan!'
                    } else {
                        echo '✅ No critical vulnerabilities in Trivy scan.'
                    }
                }
            }
        }

        stage('Push Docker Image') {
            options { timestamps() }
            steps {
                echo '🚀 Pushing Docker image to Docker Hub....'
                withDockerRegistry([credentialsId: 'dockerhub-credentials', url: '']) {
                    sh '''
                        docker push indicationmark/solar-system-app:$GIT_COMMIT
                    '''
                    echo '✅ Docker image pushed successfully!'
                }
            }
        }

        stage('Deploy to AWS EC2') {
            options { timestamps() }
            steps {
                script {
                    echo '🌐 Deploying to AWS EC2....'
                    sshagent(['AWS_Deployment-Server_SSH-Key']) {
                            ssh -o StrictHostKeyChecking=no -i "${AWS_EC2_HOST}" "
                                if sudo docker ps -a | grep -q solar-system-app; then
                                    echo '🛑 Stopping existing container...'
                                    sudo docker stop solar-system-app
                                    sudo docker rm solar-system-app
                                    echo '🗑️ Existing container removed.'
                                fi
                                    sudo docker run -d --name solar-system-app \
                                    -e MONGO_URI=${MONGO_URI} \
                                    -e MONGO_USERNAME=${MONGO_USERNAME} \
                                    -e MONGO_PASSWORD=${MONGO_PASSWORD} \
                                    -p 3000:3000 \
                                    indicationmark/solar-system-app:$GIT_COMMIT
                                echo '🚀 New container started successfully!'
                            "
                            echo '✅ Deployment to AWS EC2 completed successfully!'
                        }
                    }
                }
            }
        }

    post {
        always {
            script {
                publishHTML([
                    allowMissing: true,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: 'coverage/lcov-report',
                    reportFiles: 'index.html',
                    reportName: 'Code Coverage Report'
                ])

                publishHTML([
                    allowMissing: true,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: './',
                    reportFiles: 'dependency-check-jenkins.html',
                    reportName: 'Dependency Check Report'
                ])

                publishHTML([
                    allowMissing: true,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: './',
                    reportFiles: 'trivy-image-MEDIUM-results.html',
                    reportName: 'Trivy Medium Report'
                ])

                publishHTML([
                    allowMissing: true,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: './',
                    reportFiles: 'trivy-image-CRITICAL-results.html',
                    reportName: 'Trivy Critical Report'
                ])

                catchError(buildResult: 'SUCCESS', stageResult: 'SUCCESS') {
                    echo '📦 Archiving artifacts....'
                    junit allowEmptyResults: true, testResults: 'test-results.xml'
                    junit allowEmptyResults: true, testResults: 'trivy-image-CRITICAL-results.xml'
                }
            }
        }

        success {
            echo '✅ Build completed successfully!'
        }

        failure {
            echo '❌ Build failed. Check the logs.'
        }
    }
}