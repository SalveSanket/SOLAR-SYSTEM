pipeline {
    agent any

    tools {
        nodejs 'nodejs-22-6-0'
    }

    environment {
        MONGO_URI = "mongodb+srv://supercluster.d83jj.mongodb.net/superData"
        SONAR_SCANNER_HOME = tool 'sonarqube-scanner-610'
        DOCKER_CREDENTIALS_ID = 'dockerhub-credentials'
        AWS_SSH_KEY = 'AWS_Deployment-Server_SSH-Key'
        AWS_EC2_HOST = 'ubuntu@3.80.187.198'
    }

    options {
        disableConcurrentBuilds()
        disableResume()
        timestamps()
    }

    stages {
        stage('Checkout Code') {
            steps {
                echo '📥 Checking out code....'
                checkout scm
            }
        }

        stage('Node Version') {
            steps {
                sh '''
                    node -v
                    npm -v
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                echo '🔧 Installing dependencies....'
                sh 'npm install --no-audit'
                sh 'npm install --include=dev --no-audit'
            }
        }

        stage('Dependency Check') {
            parallel {
                stage('NPM Audit') {
                    steps {
                        sh 'npm audit --audit-level=critical || true'
                    }
                }
                stage('OWASP Dependency Check') {
                    steps {
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
            steps {
                withCredentials([usernamePassword(credentialsId: 'mongo-db-credentials', usernameVariable: 'MONGO_USERNAME', passwordVariable: 'MONGO_PASSWORD')]) {
                    echo '🧪 Running unit tests....'
                    sh 'npm test'
                }
            }
        }

        stage('Code Coverage & SonarQube') {
            parallel {
                stage('Code Coverage') {
                    steps {
                        sh 'npm run coverage'
                    }
                }
                stage('SonarQube Scan') {
                    steps {
                        withSonarQubeEnv('sonar-qube-server') {
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

        stage('Build Docker Image') {
            steps {
                sh 'docker build -t indicationmark/solar-system-app:$GIT_COMMIT .'
            }
        }

        stage('Trivy Scan') {
            steps {
                sh '''
                    trivy image indicationmark/solar-system-app:$GIT_COMMIT \
                        --severity CRITICAL --exit-code 1 --quiet \
                        --format json -o trivy-critical.json || true

                    trivy image indicationmark/solar-system-app:$GIT_COMMIT \
                        --severity LOW,MEDIUM --exit-code 0 --quiet \
                        --format json -o trivy-medium.json

                    trivy convert --format template -t "@/usr/local/share/trivy/templates/html.tpl" \
                        -o trivy-critical.html trivy-critical.json || true

                    trivy convert --format template -t "@/usr/local/share/trivy/templates/html.tpl" \
                        -o trivy-medium.html trivy-medium.json || true

                    trivy convert --format template -t "@/usr/local/share/trivy/templates/junit.tpl" \
                        -o trivy-critical.xml trivy-critical.json || true

                    trivy convert --format template -t "@/usr/local/share/trivy/templates/junit.tpl" \
                        -o trivy-medium.xml trivy-medium.json || true
                '''
            }
        }

        stage('Push Docker Image') {
            steps {
                withDockerRegistry([credentialsId: DOCKER_CREDENTIALS_ID, url: '']) {
                    sh 'docker push indicationmark/solar-system-app:$GIT_COMMIT'
                }
            }
        }

        stage('Deploy to AWS EC2') {
            steps {
                sshagent([AWS_SSH_KEY]) {
                    sh """
                        ssh -o StrictHostKeyChecking=no $AWS_EC2_HOST << 'EOF'
                            if sudo docker ps -a | grep -q solar-system-app; then
                                echo 'Stopping and removing existing container...'
                                sudo docker stop solar-system-app
                                sudo docker rm solar-system-app
                            fi
                            echo 'Starting new container...'
                            sudo docker run -d --name solar-system-app \\
                                -e MONGO_URI="$MONGO_URI" \\
                                -p 3000:3000 \\
                                indicationmark/solar-system-app:$GIT_COMMIT
                        EOF
                    """
                }
            }
        }
    }

    post {
        always {
            publishHTML([
                reportDir: 'coverage/lcov-report',
                reportFiles: 'index.html',
                reportName: 'Code Coverage Report',
                alwaysLinkToLastBuild: true,
                keepAll: true
            ])
            publishHTML([
                reportDir: './',
                reportFiles: 'dependency-check-jenkins.html',
                reportName: 'OWASP Dependency Check',
                alwaysLinkToLastBuild: true,
                keepAll: true
            ])
            publishHTML([
                reportDir: './',
                reportFiles: 'trivy-medium.html',
                reportName: 'Trivy Medium Vulnerabilities',
                alwaysLinkToLastBuild: true,
                keepAll: true
            ])
            publishHTML([
                reportDir: './',
                reportFiles: 'trivy-critical.html',
                reportName: 'Trivy Critical Vulnerabilities',
                alwaysLinkToLastBuild: true,
                keepAll: true
            ])
            junit allowEmptyResults: true, testResults: '**/*.xml'
        }

        success {
            echo '✅ Build and deployment succeeded!'
        }

        failure {
            echo '❌ Build failed. Check the console output.'
        }
    }
}