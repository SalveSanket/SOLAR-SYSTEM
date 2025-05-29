pipeline {
    agent any

    tools {
        nodejs 'nodejs-22-6-0'
    }

    environment {
        MONGO_URI = "mongodb+srv://superuser:SuperPassword@supercluster.paumtlt.mongodb.net/?retryWrites=true&w=majority&appName=superCluster"
        SONAR_SCANNER_HOME = tool 'sonarqube-scanner-610'
        DOCKER_CREDENTIALS_ID = 'dockerhub-credentials'
        AWS_EC2_HOST = '54.167.196.168'
        GITEA_TOKEN = credentials('GITEA_TOKEN')
    }

    options {
        disableConcurrentBuilds()
        disableResume()
    }

    stages {
        stage('Checkout Code') {
            options { timestamps(); retry(3) }
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
                stage('Seed Database') {
                    steps {
                        echo '🌱 Seeding database before tests...'
                        sh 'node seed.js'
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
                echo '🐳 Cleaning up old Docker images and building new one for linux/amd64 platform....'
                sh '''
                    docker rmi -f $(docker images -q) || true
                    docker buildx create --use || true
                    docker buildx build --platform linux/amd64 \
                        -t indicationmark/solar-system-app:$GIT_COMMIT \
                        --load .
                '''
            }
        }

        stage('Trivy Scan') {
            options { timestamps() }
            steps {
                echo '🔍 Running Trivy vulnerability scan....'
                script {
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

                        trivy convert --format template -t "/usr/local/share/trivy/templates/html.tpl" \
                            -o trivy-image-MEDIUM-results.html trivy-image-MEDIUM-results.json || echo "Conversion failed"

                        trivy convert --format template -t "/usr/local/share/trivy/templates/html.tpl" \
                            -o trivy-image-CRITICAL-results.html trivy-image-CRITICAL-results.json || echo "Conversion failed"

                        trivy convert --format template -t "/usr/local/share/trivy/templates/junit.tpl" \
                            -o trivy-image-MEDIUM-results.xml trivy-image-MEDIUM-results.json || echo "Conversion failed"

                        trivy convert --format template -t "/usr/local/share/trivy/templates/junit.tpl" \
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
                    sh 'docker push indicationmark/solar-system-app:$GIT_COMMIT'
                }
            }
        }

        stage('Deploy to AWS EC2') {
            options { timestamps() }
            when {
                branch pattern: "feature/.*", comparator: "REGEXP"
            }
            steps {
                withCredentials([
                    sshUserPrivateKey(credentialsId: 'AWS_Deployment-Server_SSH-Key', keyFileVariable: 'EC2_KEY'),
                    usernamePassword(credentialsId: 'mongo-db-credentials', usernameVariable: 'MONGO_USERNAME', passwordVariable: 'MONGO_PASSWORD')
                ]) {
                    echo '🌐 Deploying to AWS EC2....'
                    sh """
                        ssh -o StrictHostKeyChecking=no -i \$EC2_KEY ubuntu@${AWS_EC2_HOST} '
                            if sudo docker ps -a | grep -q solar-system-app; then
                                sudo docker stop solar-system-app
                                sudo docker rm solar-system-app
                            fi
                            sudo docker run -d --name solar-system-app \
                                -e MONGO_URI="mongodb+srv://superuser:$MONGO_PASSWORD@supercluster.d83jj.mongodb.net/superData" \
                                -e MONGO_USERNAME=\$MONGO_USERNAME \
                                -e MONGO_PASSWORD=\$MONGO_PASSWORD \
                                -p 3000:3000 \
                                indicationmark/solar-system-app:$GIT_COMMIT
                        '
                    """
                }
            }
        }

        stage('Integration Testing') {
            options { timestamps() }
            when {
                branch pattern: "feature/.*", comparator: "REGEXP"
            }
            steps {
                withAWS(credentials: 'AWS Jenkins Credentials', region: 'us-east-1') {
                    echo '🧪 Running Integration Test...'
                    sh '''
                        chmod +x integrationTesting.sh
                        ./integrationTesting.sh
                    '''
                }
            }
        }

        stage('K8 update image tag') {
            options { timestamps() }
            when {
                branch 'main'
            }
            steps {
                echo '🔄 Updating Kubernetes deployment with new image tag...'
                sh 'git clone -b main https://gitea.com/nodejsApplicationProject/solar-system-gitops-argocd-gitea'
                dir('solar-system-gitops-argocd-gitea/Kubernetes') {
                    sh '''
                        git checkout main
                        git checkout -b feature/update-image-tag-$BUILD_ID
                        sed -i "s|indicationmark/solar-system-app:.*|indicationmark/solar-system-app:$GIT_COMMIT|g" deployment.yaml

                        git config user.name "Jenkins CI"
                        git config user.email "sanketsalve01@gmail.com"
                        git remote set-url origin https://$GITEA_TOKEN@gitea.com/nodejsApplicationProject/solar-system-gitops-argocd-gitea
                        git add .
                        git commit -m "Update Docker image tag to $GIT_COMMIT"
                        git push origin -u origin feature/update-image-tag-$BUILD_ID
                    '''
                }
            }
        }
    }

    post {
        always {
            script {
                if (fileExists('solar-system-gitops-argocd-gitea/Kubernetes/deployment.yaml')) {
                    sh 'rm -rf solar-system-gitops-argocd-gitea'
                }
            }

            publishHTML reportDir: 'coverage/lcov-report', reportFiles: 'index.html', reportName: 'Code Coverage Report', allowMissing: true, alwaysLinkToLastBuild: true, keepAll: true
            publishHTML reportDir: './', reportFiles: 'dependency-check-jenkins.html', reportName: 'Dependency Check Report', allowMissing: true, alwaysLinkToLastBuild: true, keepAll: true
            publishHTML reportDir: './', reportFiles: 'trivy-image-MEDIUM-results.html', reportName: 'Trivy Medium Report', allowMissing: true, alwaysLinkToLastBuild: true, keepAll: true
            publishHTML reportDir: './', reportFiles: 'trivy-image-CRITICAL-results.html', reportName: 'Trivy Critical Report', allowMissing: true, alwaysLinkToLastBuild: true, keepAll: true

            catchError(buildResult: 'SUCCESS', stageResult: 'SUCCESS') {
                junit allowEmptyResults: true, testResults: 'test-results.xml'
                junit allowEmptyResults: true, testResults: 'trivy-image-CRITICAL-results.xml'
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
